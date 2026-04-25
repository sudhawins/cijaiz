import sql from 'mssql';
import { getPool } from '../database';

/**
 * Pro-Rata Electricity Charge Service
 * Handles all calculations for distributing electricity charges among tenants
 * based on their occupancy dates and pro-rata basis
 */

interface OccupancyRecord {
  TenantId: number;
  CheckInDate: string; // nchar(10) in YYYY-MM-DD format
  CheckOutDate: string | null; // nchar(10) or NULL
  RoomId: number;
}

interface ChargeRecord {
  ServiceConsumptionId: number;
  TenantId: number;
  RoomId: number;
  ServiceId: number;
  BillingMonth: number;
  BillingYear: number;
  TotalUnitsForRoom: number;
  ProRataUnits: number;
  ProRataPercentage: number;
  ChargePerUnit: number;
  TotalCharge: number;
  CheckInDate: Date;
  CheckOutDate: Date | null;
  OccupancyDaysInMonth: number;
  TotalDaysInMonth: number;
}

/**
 * Convert nchar(10) date string to Date object
 * Handles NULL and empty string cases
 */
function parseNcharDate(dateString: string | null): Date | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  const trimmed = dateString.trim();
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get the last day of a given month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate days occupied in a billing month for a tenant
 */
function calculateOccupancyDays(
  checkInDate: Date,
  checkOutDate: Date | null,
  monthStart: Date,
  monthEnd: Date
): number {
  // Determine actual occupancy period within the month
  const actualCheckIn = checkInDate > monthStart ? checkInDate : monthStart;
  const actualCheckOut = !checkOutDate || checkOutDate > monthEnd ? monthEnd : checkOutDate;

  // If checkout is before month start, tenant didn't occupy during this month
  if (actualCheckOut < monthStart) {
    return 0;
  }

  // If checkin is after month end, tenant won't occupy during this month
  if (actualCheckIn > monthEnd) {
    return 0;
  }

  // Calculate difference in days, add 1 to include both start and end dates
  const diffTime = actualCheckOut.getTime() - actualCheckIn.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(0, diffDays);
}

/**
 * Calculate pro-rata charges for a service consumption record
 */
export async function calculateProRataCharges(
  serviceConsumptionId: number,
  chargePerUnit: number = 15.00
): Promise<{ success: boolean; message: string; chargesCreated?: number }> {
  const pool = getPool();

  try {
    // Get service consumption details
    const consumptionResult = await pool
      .request()
      .input('serviceConsumptionId', sql.Int, serviceConsumptionId)
      .query(`
        SELECT 
          scd.Id,
          scd.ServiceAllocId,
          scd.UnitsConsumed,
          scd.ReadingTakenDate,
          sra.ServiceId,
          sra.RoomId
        FROM [dbo].[ServiceConsumptionDetails] scd
        INNER JOIN [dbo].[ServiceRoomAllocation] sra ON scd.ServiceAllocId = sra.Id
        WHERE scd.Id = @serviceConsumptionId
      `);

    if (consumptionResult.recordset.length === 0) {
      throw new Error(`Service consumption record ${serviceConsumptionId} not found`);
    }

    const consumption = consumptionResult.recordset[0];
    const { ServiceId, RoomId, UnitsConsumed, ReadingTakenDate } = consumption;

    // Extract billing month and year
    const readingDate = new Date(ReadingTakenDate);
    const billingMonth = readingDate.getMonth() + 1;
    const billingYear = readingDate.getFullYear();

    // Calculate month boundaries
    const monthStart = new Date(billingYear, billingMonth - 1, 1);
    const monthEnd = new Date(billingYear, billingMonth, 0);
    const daysInMonth = monthEnd.getDate();

    // Get all occupancy records for the room during the billing month
    const occupancyResult = await pool
      .request()
      .input('roomId', sql.Int, RoomId)
      .input('monthStart', sql.DateTime, monthStart)
      .input('monthEnd', sql.DateTime, monthEnd)
      .query(`
        SELECT 
          o.TenantId,
          o.CheckInDate,
          o.CheckOutDate,
          o.RoomId
        FROM [dbo].[Occupancy] o
        WHERE o.RoomId = @roomId
          AND CONVERT(DATE, LTRIM(RTRIM(o.CheckInDate))) <= @monthEnd
          AND (o.CheckOutDate IS NULL 
               OR LTRIM(RTRIM(o.CheckOutDate)) = '' 
               OR CONVERT(DATE, LTRIM(RTRIM(o.CheckOutDate))) >= @monthStart)
      `);

    const occupancies = occupancyResult.recordset as OccupancyRecord[];

    // Delete existing charges for this consumption (for recalculation)
    await pool
      .request()
      .input('serviceConsumptionId', sql.Int, serviceConsumptionId)
      .query(
        `DELETE FROM [dbo].[TenantServiceCharges] WHERE [ServiceConsumptionId] = @serviceConsumptionId`
      );

    // Calculate and insert charges for each tenant
    const charges: ChargeRecord[] = [];

    for (const occupancy of occupancies) {
      const checkInDate = parseNcharDate(occupancy.CheckInDate);
      const checkOutDate = parseNcharDate(occupancy.CheckOutDate);

      if (!checkInDate) continue; // Skip invalid dates

      const occupancyDays = calculateOccupancyDays(checkInDate, checkOutDate, monthStart, monthEnd);

      if (occupancyDays <= 0) continue; // Skip if not occupied during this month

      // Calculate pro-rata units and percentage
      const proRataUnits = (UnitsConsumed * occupancyDays) / daysInMonth;
      const proRataPercentage = (occupancyDays / daysInMonth) * 100;
      const totalCharge = proRataUnits * chargePerUnit;

      charges.push({
        ServiceConsumptionId: serviceConsumptionId,
        TenantId: occupancy.TenantId,
        RoomId: RoomId,
        ServiceId: ServiceId,
        BillingMonth: billingMonth,
        BillingYear: billingYear,
        TotalUnitsForRoom: UnitsConsumed,
        ProRataUnits: Math.round(proRataUnits * 100) / 100, // Round to 2 decimals
        ProRataPercentage: Math.round(proRataPercentage * 100) / 100,
        ChargePerUnit: chargePerUnit,
        TotalCharge: Math.round(totalCharge * 100) / 100,
        CheckInDate: checkInDate,
        CheckOutDate: checkOutDate,
        OccupancyDaysInMonth: occupancyDays,
        TotalDaysInMonth: daysInMonth
      });
    }

    // Insert all charges in batch
    if (charges.length > 0) {
      const insertQuery = charges
        .map(
          (_, index) => `
        INSERT INTO [dbo].[TenantServiceCharges] (
          [ServiceConsumptionId], [TenantId], [RoomId], [ServiceId],
          [BillingMonth], [BillingYear], [TotalUnitsForRoom],
          [ProRataUnits], [ProRataPercentage], [ChargePerUnit], [TotalCharge],
          [CheckInDate], [CheckOutDate], [OccupancyDaysInMonth], [TotalDaysInMonth]
        ) VALUES (
          @serviceConsumptionId, @tenantId${index}, @roomId${index}, @serviceId${index},
          @billingMonth${index}, @billingYear${index}, @totalUnits${index},
          @proRataUnits${index}, @proRataPercentage${index}, @chargePerUnit${index}, @totalCharge${index},
          @checkInDate${index}, @checkOutDate${index}, @occupancyDays${index}, @daysInMonth${index}
        )
      `
        )
        .join(';');

      let request = pool.request().input('serviceConsumptionId', sql.Int, serviceConsumptionId);

      charges.forEach((charge, index) => {
        request
          .input(`tenantId${index}`, sql.Int, charge.TenantId)
          .input(`roomId${index}`, sql.Int, charge.RoomId)
          .input(`serviceId${index}`, sql.Int, charge.ServiceId)
          .input(`billingMonth${index}`, sql.Int, charge.BillingMonth)
          .input(`billingYear${index}`, sql.Int, charge.BillingYear)
          .input(`totalUnits${index}`, sql.Int, charge.TotalUnitsForRoom)
          .input(`proRataUnits${index}`, sql.Decimal(10, 2), charge.ProRataUnits)
          .input(`proRataPercentage${index}`, sql.Decimal(5, 2), charge.ProRataPercentage)
          .input(`chargePerUnit${index}`, sql.Money, charge.ChargePerUnit)
          .input(`totalCharge${index}`, sql.Money, charge.TotalCharge)
          .input(`checkInDate${index}`, sql.Date, charge.CheckInDate)
          .input(`checkOutDate${index}`, charge.CheckOutDate ? sql.Date : sql.Date, charge.CheckOutDate)
          .input(`occupancyDays${index}`, sql.Int, charge.OccupancyDaysInMonth)
          .input(`daysInMonth${index}`, sql.Int, charge.TotalDaysInMonth);
      });

      await request.query(insertQuery);

      // Update service consumption as processed
      await pool
        .request()
        .input('serviceConsumptionId', sql.Int, serviceConsumptionId)
        .query(
          `UPDATE [dbo].[ServiceConsumptionDetails] SET [UpdatedDate] = GETDATE() WHERE [Id] = @serviceConsumptionId`
        );
    }

    return {
      success: true,
      message: `Pro-rata charges calculated for ${charges.length} tenants`,
      chargesCreated: charges.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to calculate pro-rata charges: ${errorMessage}`);
  }
}

/**
 * Get tenant charges for a specific month
 */
export async function getTenantChargesForMonth(
  billingYear: number,
  billingMonth: number,
  tenantId?: number,
  roomId?: number
) {
  const pool = getPool();

  try {
    let query = `
      SELECT 
           tsc.[Id] as id,
           tsc.[ServiceConsumptionId] as serviceConsumptionId,
           tsc.[TenantId] as tenantId,
           LTRIM(RTRIM(t.[Name])) as tenantName,
           LTRIM(RTRIM(t.[Phone])) as tenantPhone,
           tsc.[RoomId] as roomId,
           LTRIM(RTRIM(rd.[Number])) as roomNumber,
           tsc.[ServiceId] as serviceId,
           sd.[ConsumerName] as serviceName,
           sd.[MeterNo] as meterNo,
           tsc.[BillingMonth] as billingMonth,
           tsc.[BillingYear] as billingYear,
           CONCAT(tsc.[BillingMonth], '/', tsc.[BillingYear]) as billingPeriod,
           tsc.[TotalUnitsForRoom] as totalUnitsForRoom,
           tsc.[ProRataUnits] as proRataUnits,
           tsc.[ProRataPercentage] as proRataPercentage,
           tsc.[ChargePerUnit] as chargePerUnit,
           tsc.[TotalCharge] as totalCharge,
           CONVERT(DATE, tsc.[CheckInDate]) as checkInDate,
           CASE WHEN tsc.[CheckOutDate] IS NULL 
             THEN NULL 
             ELSE CONVERT(DATE, tsc.[CheckOutDate]) 
           END as checkOutDate,
           tsc.[OccupancyDaysInMonth] as occupancyDaysInMonth,
           tsc.[TotalDaysInMonth] as totalDaysInMonth,
           tsc.[Status] as status,
           tsc.[CreatedDate] as createdDate,
           tsc.[UpdatedDate] as updatedDate
      FROM [dbo].[TenantServiceCharges] tsc
      INNER JOIN [dbo].[Tenant] t ON tsc.[TenantId] = t.[Id]
      INNER JOIN [dbo].[RoomDetail] rd ON tsc.[RoomId] = rd.[Id]
      INNER JOIN [dbo].[ServiceDetails] sd ON tsc.[ServiceId] = sd.[Id]
      WHERE tsc.[BillingYear] = @billingYear
        AND tsc.[BillingMonth] = @billingMonth
    `;

    const request = pool
      .request()
      .input('billingYear', sql.Int, billingYear)
      .input('billingMonth', sql.Int, billingMonth);

    if (tenantId) {
      query += ` AND tsc.[TenantId] = @tenantId`;
      request.input('tenantId', sql.Int, tenantId);
    }

    if (roomId) {
      query += ` AND tsc.[RoomId] = @roomId`;
      request.input('roomId', sql.Int, roomId);
    }

    query += ` ORDER BY tsc.[RoomId], tsc.[TenantId]`;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve tenant charges: ${errorMessage}`);
  }
}

/**
 * Get room billing summary for a month
 */
export async function getRoomBillingsSummary(billingYear: number, billingMonth: number, roomId?: number) {
  const pool = getPool();

  try {
    let query = `
      SELECT 
        rd.[Id] as id,
        LTRIM(RTRIM(rd.[Number])) as roomNumber,
        sd.[Id] as serviceId,
        sd.[ConsumerName] as serviceName,
        sd.[MeterNo] as meterNo,
        MAX(tsc.[TotalUnitsForRoom]) as totalUnitsConsumed,
        COUNT(DISTINCT tsc.[TenantId]) as numberOfTenants,
        SUM(tsc.[TotalCharge]) as totalChargeForRoom,
        tsc.[BillingMonth] as billingMonth,
        tsc.[BillingYear] as billingYear
      FROM [dbo].[TenantServiceCharges] tsc
      INNER JOIN [dbo].[RoomDetail] rd ON tsc.[RoomId] = rd.[Id]
      INNER JOIN [dbo].[ServiceDetails] sd ON tsc.[ServiceId] = sd.[Id]
      WHERE tsc.[BillingYear] = @billingYear
        AND tsc.[BillingMonth] = @billingMonth
    `;

    const request = pool
      .request()
      .input('billingYear', sql.Int, billingYear)
      .input('billingMonth', sql.Int, billingMonth);

    if (roomId) {
      query += ` AND tsc.[RoomId] = @roomId`;
      request.input('roomId', sql.Int, roomId);
    }

    query += `
      GROUP BY rd.[Id], rd.[Number], sd.[Id], sd.[ConsumerName], sd.[MeterNo], tsc.[BillingMonth], tsc.[BillingYear]
      ORDER BY rd.[Number]
    `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve room billing summary: ${errorMessage}`);
  }
}

/**
 * Get monthly billing report (aggregate statistics)
 */
export async function getMonthlyBillingReport(billingYear: number, billingMonth: number) {
  const pool = getPool();

  try {
    const result = await pool
      .request()
      .input('billingYear', sql.Int, billingYear)
      .input('billingMonth', sql.Int, billingMonth)
      .query(`
        SELECT 
          @billingMonth as billingMonth,
          @billingYear as billingYear,
          CONCAT(@billingMonth, '/', @billingYear) as billingPeriod,
          COUNT(DISTINCT tsc.[RoomId]) as roomsWithCharges,
          COUNT(DISTINCT tsc.[ServiceId]) as servicesInvoiced,
          COUNT(DISTINCT tsc.[TenantId]) as tenantsCharged,
          SUM(tsc.[TotalUnitsForRoom]) as totalUnitsConsumed,
          CAST(AVG(tsc.[ProRataPercentage]) AS DECIMAL(5, 2)) as avgOccupancyPercentage,
          SUM(tsc.[TotalCharge]) as totalChargeAmount
        FROM [dbo].[TenantServiceCharges] tsc
        WHERE tsc.[BillingYear] = @billingYear
          AND tsc.[BillingMonth] = @billingMonth
      `);

    return result.recordset[0] || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve monthly billing report: ${errorMessage}`);
  }
}

/**
 * Get tenant monthly bill for all months
 */
export async function getTenantMonthlyBill(tenantId: number) {
  const pool = getPool();

  try {
    const result = await pool
      .request()
      .input('tenantId', sql.Int, tenantId)
      .query(`
        SELECT 
          t.[Id],
          LTRIM(RTRIM(t.[Name])) as TenantName,
          LTRIM(RTRIM(t.[Phone])) as TenantPhone,
          tsc.[BillingMonth],
          tsc.[BillingYear],
          CONCAT(tsc.[BillingMonth], '/', tsc.[BillingYear]) as BillingPeriod,
          LTRIM(RTRIM(rd.[Number])) as RoomNumber,
          sd.[ConsumerName] as ServiceName,
          sd.[MeterNo],
          tsc.[TotalUnitsForRoom],
          tsc.[ProRataUnits],
          tsc.[ProRataPercentage],
          tsc.[ChargePerUnit],
          tsc.[TotalCharge],
          tsc.[OccupancyDaysInMonth],
          tsc.[TotalDaysInMonth],
          tsc.[Status]
        FROM [dbo].[TenantServiceCharges] tsc
        INNER JOIN [dbo].[Tenant] t ON tsc.[TenantId] = t.[Id]
        INNER JOIN [dbo].[RoomDetail] rd ON tsc.[RoomId] = rd.[Id]
        INNER JOIN [dbo].[ServiceDetails] sd ON tsc.[ServiceId] = sd.[Id]
        WHERE tsc.[TenantId] = @tenantId
        ORDER BY tsc.[BillingYear] DESC, tsc.[BillingMonth] DESC
      `);

    return result.recordset;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve tenant monthly bill: ${errorMessage}`);
  }
}

/**
 * Recalculate all charges for a billing month
 */
export async function recalculateMonthlyCharges(
  billingYear: number,
  billingMonth: number,
  chargePerUnit: number = 15.00
) {
  const pool = getPool();

  try {
    // Get all service consumption records for the month and recalculate
    const consumptionResult = await pool
      .request()
      .input('year', sql.Int, billingYear)
      .input('month', sql.Int, billingMonth)
      .query(`
        SELECT DISTINCT scd.[Id]
        FROM [dbo].[ServiceConsumptionDetails] scd
        WHERE YEAR(scd.[ReadingTakenDate]) = @year
          AND MONTH(scd.[ReadingTakenDate]) = @month
      `);

    const consumptionRecords = consumptionResult.recordset;
    let totalChargesCreated = 0;

    for (const record of consumptionRecords) {
      const result = await calculateProRataCharges(record.Id, chargePerUnit);
      totalChargesCreated += result.chargesCreated || 0;
    }

    return {
      success: true,
      message: `Recalculated charges for ${consumptionRecords.length} service consumption records`,
      servicesProcessed: consumptionRecords.length,
      totalChargesCreated
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to recalculate monthly charges: ${errorMessage}`);
  }
}

/**
 * Get detailed EB report for a month with room-level readings and tenant-wise split
 */
export async function getRoomMonthlyEbReport(
  billingYear: number,
  billingMonth: number,
  roomId?: number
) {
  const pool = getPool();

  try {
    let query = `
      SELECT
        scd.[Id] as ServiceConsumptionId,
        scd.[ServiceAllocId],
        sra.[RoomId],
        LTRIM(RTRIM(rd.[Number])) as RoomNumber,
        rd.[Beds] as Beds,
        CASE WHEN ISNULL(rd.[Beds], 0) = 0 THEN 'Shop' ELSE 'Residential' END as RoomType,
        sra.[ServiceId],
        sd.[ConsumerName] as ServiceName,
        sd.[MeterNo],
        scd.[ReadingTakenDate],
        scd.[StartingMeterReading],
        scd.[EndingMeterReading],
        scd.[UnitsConsumed],
        scd.[UnitRate],
        scd.[AmountToBeCollected],
        tsc.[Id] as TenantChargeId,
        tsc.[TenantId],
        LTRIM(RTRIM(t.[Name])) as TenantName,
        LTRIM(RTRIM(t.[Phone])) as TenantPhone,
        tsc.[ProRataUnits],
        tsc.[ProRataPercentage],
        tsc.[TotalCharge],
           CONVERT(DATE, tsc.[CheckInDate]) as CheckInDate,
           CASE WHEN tsc.[CheckOutDate] IS NULL
             THEN NULL
             ELSE CONVERT(DATE, tsc.[CheckOutDate])
           END as CheckOutDate,
        tsc.[OccupancyDaysInMonth],
        tsc.[TotalDaysInMonth],
        tsc.[Status]
      FROM [dbo].[ServiceConsumptionDetails] scd
      INNER JOIN [dbo].[ServiceRoomAllocation] sra ON scd.[ServiceAllocId] = sra.[Id]
      INNER JOIN [dbo].[RoomDetail] rd ON sra.[RoomId] = rd.[Id]
      INNER JOIN [dbo].[ServiceDetails] sd ON sra.[ServiceId] = sd.[Id]
      LEFT JOIN [dbo].[TenantServiceCharges] tsc ON tsc.[ServiceConsumptionId] = scd.[Id]
      LEFT JOIN [dbo].[Tenant] t ON tsc.[TenantId] = t.[Id]
      WHERE YEAR(scd.[ReadingTakenDate]) = @billingYear
        AND MONTH(scd.[ReadingTakenDate]) = @billingMonth
    `;

    const request = pool
      .request()
      .input('billingYear', sql.Int, billingYear)
      .input('billingMonth', sql.Int, billingMonth);

    if (roomId) {
      query += ` AND sra.[RoomId] = @roomId`;
      request.input('roomId', sql.Int, roomId);
    }

    query += `
      ORDER BY rd.[Number] ASC, scd.[ReadingTakenDate] DESC, t.[Name] ASC
    `;

    const result = await request.query(query);

    const reportMap = new Map<number, any>();

    for (const row of result.recordset) {
      const key = row.ServiceConsumptionId;

      if (!reportMap.has(key)) {
        reportMap.set(key, {
          serviceConsumptionId: row.ServiceConsumptionId,
          serviceAllocId: row.ServiceAllocId,
          roomId: row.RoomId,
          roomNumber: row.RoomNumber,
          beds: row.Beds,
          roomType: row.RoomType,
          serviceId: row.ServiceId,
          serviceName: row.ServiceName,
          meterNo: row.MeterNo,
          readingTakenDate: row.ReadingTakenDate,
          startingReading: row.StartingMeterReading,
          endingReading: row.EndingMeterReading,
          unitsConsumed: row.UnitsConsumed,
          unitRate: row.UnitRate,
          totalAmount: row.AmountToBeCollected,
          tenants: [] as any[]
        });
      }

      if (row.TenantId) {
        reportMap.get(key).tenants.push({
          tenantChargeId: row.TenantChargeId,
          tenantId: row.TenantId,
          tenantName: row.TenantName,
          tenantPhone: row.TenantPhone,
          splitUnits: row.ProRataUnits,
          splitPercentage: row.ProRataPercentage,
          splitCharge: row.TotalCharge,
          checkInDate: row.CheckInDate,
          checkOutDate: row.CheckOutDate,
          occupancyDaysInMonth: row.OccupancyDaysInMonth,
          totalDaysInMonth: row.TotalDaysInMonth,
          status: row.Status
        });
      }
    }

    return Array.from(reportMap.values());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve room monthly EB report: ${errorMessage}`);
  }
}
