import { Trash2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type DeleteIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
};

export const DeleteIconButton = ({ label, className = "", type = "button", ...props }: DeleteIconButtonProps) => {
  return (
    <button
      type={type}
      className={`rounded border border-token-risk/35 p-2 text-token-risk hover:bg-token-risk/10 ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
    </button>
  );
};
