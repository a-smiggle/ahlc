import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const SectionHeader = ({ title, action, className = "" }: SectionHeaderProps) => {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      {title}
      {action}
    </div>
  );
};
