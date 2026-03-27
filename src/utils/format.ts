export const currency = (value: number): string => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
};

export const percent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};
