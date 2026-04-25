import sql from 'mssql';
import { getPool } from '../database';

/**
 * Pro-Rata Rent Calculation Service
 * Handles calculation of pro-rata rent for tenant check-in and check-out
 * - On check-in: Calculate pro-rata rent from check-in date to end of month
 * - On check-out: Calculate pro-rata rent from check-out date (for partial month)
 */

interface ProRataRentResult {
  calculatedRent: number;
  fullMonthRent: number;
  occupancyDays: number;
  totalDaysInMonth: number;
  proRataPercentage: number;
}

/**
 * Get the last day of a given month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate pro-rata rent from check-in date to end of month
 * Used when tenant checks in mid-month
 * 
 * @param checkInDate - Date of check-in (YYYY-MM-DD format or Date object)
 * @param fullMonthRent - Full month rent amount
 * @returns Calculated pro-rata rent and metadata
 */
export function calculateCheckInProRataRent(
  checkInDate: string | Date,
  fullMonthRent: number
): ProRataRentResult {
  // Parse the check-in date
  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : checkInDate;
  
  // Get the last day of the check-in month
  const year = checkIn.getFullYear();
  const month = checkIn.getMonth() + 1;
  const lastDay = getLastDayOfMonth(year, month);
  
  // Create end of month date
  const monthEnd = new Date(year, month - 1, lastDay);
  
  // Calculate occupancy days (inclusive of both start and end dates)
  const occupancyDays = lastDay - checkIn.getDate() + 1;
  
  // Calculate pro-rata rent
  const proRataPercentage = (occupancyDays / lastDay) * 100;
  const calculatedRent = Math.round((fullMonthRent * occupancyDays) / lastDay * 100) / 100;
  
  return {
    calculatedRent,
    fullMonthRent,
    occupancyDays,
    totalDaysInMonth: lastDay,
    proRataPercentage: Math.round(proRataPercentage * 100) / 100
  };
}

/**
 * Calculate pro-rata rent from check-out date (rent owed for partial month on checkout)
 * Used when tenant checks out mid-month
 * 
 * @param checkOutDate - Date of check-out (YYYY-MM-DD format or Date object)
 * @param fullMonthRent - Full month rent amount
 * @returns Calculated pro-rata rent and metadata
 */
export function calculateCheckOutProRataRent(
  checkOutDate: string | Date,
  fullMonthRent: number
): ProRataRentResult {
  // Parse the check-out date
  const checkOut = typeof checkOutDate === 'string' ? new Date(checkOutDate) : checkOutDate;
  
  // Get the last day of the check-out month
  const year = checkOut.getFullYear();
  const month = checkOut.getMonth() + 1;
  const lastDay = getLastDayOfMonth(year, month);
  
  // Calculate occupancy days from start of month to check-out date (inclusive)
  const occupancyDays = checkOut.getDate();
  
  // Calculate pro-rata rent
  const proRataPercentage = (occupancyDays / lastDay) * 100;
  const calculatedRent = Math.round((fullMonthRent * occupancyDays) / lastDay * 100) / 100;
  
  return {
    calculatedRent,
    fullMonthRent,
    occupancyDays,
    totalDaysInMonth: lastDay,
    proRataPercentage: Math.round(proRataPercentage * 100) / 100
  };
}

/**
 * Calculate pro-rata rent for a period within a month
 * Used for occupancies spanning multiple months or partial months
 * 
 * @param checkInDate - Check-in date (YYYY-MM-DD format or Date object)
 * @param checkOutDate - Check-out date (YYYY-MM-DD format or Date object)
 * @param fullMonthRent - Full month rent amount
 * @returns Calculated pro-rata rent and metadata
 */
export function calculateProRataRentForPeriod(
  checkInDate: string | Date,
  checkOutDate: string | Date,
  fullMonthRent: number
): ProRataRentResult {
  // Parse dates
  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : checkInDate;
  const checkOut = typeof checkOutDate === 'string' ? new Date(checkOutDate) : checkOutDate;
  
  // Normalize to start of day for accurate date comparison
  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);
  
  // If both dates are in the same month
  const year = checkIn.getFullYear();
  const month = checkIn.getMonth() + 1;
  
  if (
    checkOut.getFullYear() === year &&
    checkOut.getMonth() + 1 === month
  ) {
    // Same month - calculate days between
    const occupancyDays = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const lastDay = getLastDayOfMonth(year, month);
    
    const proRataPercentage = (occupancyDays / lastDay) * 100;
    const calculatedRent = Math.round((fullMonthRent * occupancyDays) / lastDay * 100) / 100;
    
    return {
      calculatedRent,
      fullMonthRent,
      occupancyDays,
      totalDaysInMonth: lastDay,
      proRataPercentage: Math.round(proRataPercentage * 100) / 100
    };
  }
  
  // Different months - sum pro-rata for each month
  let totalCalculatedRent = 0;
  let totalOccupancyDays = 0;
  
  // First month: from check-in to end of month
  const firstMonthLastDay = getLastDayOfMonth(checkIn.getFullYear(), checkIn.getMonth() + 1);
  const firstMonthDays = firstMonthLastDay - checkIn.getDate() + 1;
  totalCalculatedRent += (fullMonthRent * firstMonthDays) / firstMonthLastDay;
  totalOccupancyDays += firstMonthDays;
  
  // Middle months: full months (if any)
  let currentDate = new Date(checkIn.getFullYear(), checkIn.getMonth() + 1, 1);
  while (currentDate < checkOut) {
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const nextMonthDate = new Date(currentYear, currentMonth, 1);
    
    if (nextMonthDate <= checkOut) {
      // Full month
      const daysInMonth = getLastDayOfMonth(currentYear, currentMonth);
      totalCalculatedRent += fullMonthRent;
      totalOccupancyDays += daysInMonth;
    } else {
      // Partial month (check-out month)
      const checkOutDay = checkOut.getDate();
      totalCalculatedRent += (fullMonthRent * checkOutDay) / getLastDayOfMonth(currentYear, currentMonth);
      totalOccupancyDays += checkOutDay;
      break;
    }
    
    currentDate = nextMonthDate;
  }
  
  // Calculate average days in month for percentage
  const avgDaysInMonth = totalOccupancyDays / Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const proRataPercentage = (totalOccupancyDays / avgDaysInMonth) * 100;
  
  return {
    calculatedRent: Math.round(totalCalculatedRent * 100) / 100,
    fullMonthRent,
    occupancyDays: totalOccupancyDays,
    totalDaysInMonth: Math.ceil(avgDaysInMonth),
    proRataPercentage: Math.round(proRataPercentage * 100) / 100
  };
}

/**
 * Store pro-rata rent calculation in database (optional, for audit trail)
 * Creates a record of the pro-rata calculation for the occupancy
 */
export async function recordProRataRentCalculation(
  occupancyId: number,
  checkInDate: string,
  checkOutDate: string | null,
  fullMonthRent: number,
  calculatedRent: number,
  occupancyDays: number,
  totalDaysInMonth: number,
  calculationType: 'check-in' | 'check-out' | 'period'
): Promise<{ success: boolean; message: string }> {
  const pool = getPool();
  
  try {
    // Check if table exists for storing calculations
    const tableCheckResult = await pool
      .request()
      .query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'TenantRentCalculations'
      `);
    
    // Only record if table exists (optional feature)
    if (tableCheckResult.recordset.length > 0) {
      await pool
        .request()
        .input('occupancyId', sql.Int, occupancyId)
        .input('checkInDate', sql.Date, new Date(checkInDate))
        .input('checkOutDate', sql.Date, checkOutDate ? new Date(checkOutDate) : null)
        .input('fullMonthRent', sql.Money, fullMonthRent)
        .input('calculatedRent', sql.Money, calculatedRent)
        .input('occupancyDays', sql.Int, occupancyDays)
        .input('totalDaysInMonth', sql.Int, totalDaysInMonth)
        .input('calculationType', sql.NVarChar(20), calculationType)
        .query(`
          INSERT INTO TenantRentCalculations (
            OccupancyId, CheckInDate, CheckOutDate, FullMonthRent, 
            CalculatedRent, OccupancyDays, TotalDaysInMonth, 
            CalculationType, CreatedDate
          ) VALUES (
            @occupancyId, @checkInDate, @checkOutDate, @fullMonthRent,
            @calculatedRent, @occupancyDays, @totalDaysInMonth,
            @calculationType, GETUTCDATE()
          )
        `);
    }
    
    return {
      success: true,
      message: `Pro-rata rent calculation recorded for occupancy ${occupancyId}`
    };
  } catch (error) {
    console.error('Error recording pro-rata rent calculation:', error);
    // Don't throw - this is optional audit functionality
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Calculate pro-rata rent for a specific month based on occupancy dates
 * Used in payment tracking to determine rent owed for the specific month
 * 
 * @param checkInDate - Tenant check-in date (YYYY-MM-DD format or Date object)
 * @param checkOutDate - Tenant check-out date (YYYY-MM-DD format or Date object), null if still occupying
 * @param fullMonthRent - Full month rent amount
 * @param year - The year to calculate pro-rata for
 * @param month - The month to calculate pro-rata for (1-12)
 * @returns Pro-rata rent for that specific month
 */
export function calculateProRataRentForMonth(
  checkInDate: string | Date,
  checkOutDate: string | Date | null,
  fullMonthRent: number,
  year: number,
  month: number
): number {
  // Parse dates
  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);
  
  const checkOut = checkOutDate 
    ? (typeof checkOutDate === 'string' ? new Date(checkOutDate) : new Date(checkOutDate))
    : null;
  if (checkOut) {
    checkOut.setHours(0, 0, 0, 0);
  }
  
  // Get the first and last day of the target month
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  
  const lastDayOfMonth = getLastDayOfMonth(year, month);
  const monthEnd = new Date(year, month - 1, lastDayOfMonth);
  monthEnd.setHours(0, 0, 0, 0);
  
  // Check if tenant was occupying any day in this month
  if (checkIn > monthEnd) {
    // Tenant checks in after this month ends
    return 0;
  }
  
  if (checkOut && checkOut < monthStart) {
    // Tenant checks out before this month starts
    return 0;
  }
  
  // Calculate occupancy period within this month
  const occupancyStart = checkIn <= monthStart ? monthStart : checkIn;
  const occupancyEnd = checkOut && checkOut <= monthEnd ? checkOut : monthEnd;
  
  // Calculate occupancy days (inclusive of both dates)
  const occupancyDays = Math.floor((occupancyEnd.getTime() - occupancyStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Calculate pro-rata rent for this month
  const proRataRent = Math.round((fullMonthRent * occupancyDays) / lastDayOfMonth * 100) / 100;
  
  return proRataRent;
}

/**
 * Calculate occupancy days for a specific month
 * Returns only the number of days the tenant occupied during the month
 * 
 * @param checkInDate - Tenant check-in date
 * @param checkOutDate - Tenant check-out date (null if still occupying)
 * @param year - The year to calculate for
 * @param month - The month to calculate for (1-12)
 * @returns Number of occupancy days in that month
 */
export function calculateOccupancyDaysForMonth(
  checkInDate: string | Date,
  checkOutDate: string | Date | null,
  year: number,
  month: number
): number {
  // Parse dates
  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);
  
  const checkOut = checkOutDate 
    ? (typeof checkOutDate === 'string' ? new Date(checkOutDate) : new Date(checkOutDate))
    : null;
  if (checkOut) {
    checkOut.setHours(0, 0, 0, 0);
  }
  
  // Get the first and last day of the target month
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  
  const lastDayOfMonth = getLastDayOfMonth(year, month);
  const monthEnd = new Date(year, month - 1, lastDayOfMonth);
  monthEnd.setHours(0, 0, 0, 0);
  
  // Check if tenant was occupying any day in this month
  if (checkIn > monthEnd) {
    // Tenant checks in after this month ends
    return 0;
  }
  
  if (checkOut && checkOut < monthStart) {
    // Tenant checks out before this month starts
    return 0;
  }
  
  // Calculate occupancy period within this month
  const occupancyStart = checkIn <= monthStart ? monthStart : checkIn;
  const occupancyEnd = checkOut && checkOut <= monthEnd ? checkOut : monthEnd;
  
  // Calculate occupancy days (inclusive of both dates)
  const occupancyDays = Math.floor((occupancyEnd.getTime() - occupancyStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return occupancyDays;
}
