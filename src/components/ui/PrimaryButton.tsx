import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export const PrimaryButton = ({ children, className = "", type = "button", ...props }: PrimaryButtonProps) => {
  return (
    <button
      type={type}
      className={`rounded px-3 py-2 text-sm font-semibold text-white ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
