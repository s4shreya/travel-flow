import { Link, type LinkProps } from "react-router-dom";

import { buttonClass, type ButtonVariant } from "@/components/ui/buttonStyles";

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
}

/** Router link styled as a button (navigation actions). */
export function LinkButton({ variant = "secondary", className = "", ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
