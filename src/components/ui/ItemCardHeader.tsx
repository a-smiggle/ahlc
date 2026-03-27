import type { ReactNode } from "react";

interface ItemCardHeaderProps {
  label: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const ItemCardHeader = ({ label, action, className = "" }: ItemCardHeaderProps) => {
  return (
    <div className={`mb-3 flex items-start justify-between ${className}`.trim()}>
      {label}
      {action}
    </div>
  );
};
