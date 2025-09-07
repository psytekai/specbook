export const formatPrice = (price: number | undefined): string => {
  if (!price) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
};

export const truncateString = (str: string, maxLength: number): string => {
  if (!str) return '';
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
};

export const formatDate = (date: Date | string): string => {
  if (!date) return 'N/A';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

export const formatArray = (arr: string[] | string, separator: string = ', '): string => {
  if (Array.isArray(arr)) {
    return arr.join(separator);
  }
  return arr || 'N/A';
};