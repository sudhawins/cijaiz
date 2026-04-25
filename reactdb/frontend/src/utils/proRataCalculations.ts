/**
 * Pro-Rata Rent Calculation Utilities
 * Client-side utility functions to calculate pro-rata rent for display purposes
 */

export interface ProRataRentCalculation {
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
 */
export function calculateCheckInProRataRent(
  checkInDate: string | Date,
  fullMonthRent: number
): ProRataRentCalculation {
  // Parse the check-in date
  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : checkInDate;
  
  // Get the last day of the check-in month
  const year = checkIn.getFullYear();
  const month = checkIn.getMonth() + 1;
  const lastDay = getLastDayOfMonth(year, month);
  
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
 * Calculate pro-rata rent from checkout date (rent owed for partial month on checkout)
 * Used when tenant checks out mid-month
 */
export function calculateCheckOutProRataRent(
  checkOutDate: string | Date,
  fullMonthRent: number
): ProRataRentCalculation {
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
