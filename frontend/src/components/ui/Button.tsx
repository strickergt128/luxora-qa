import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export default function Button({
  className = "",
  variant = "secondary",
  ...rest
}: Props) {
  const base = variant === "primary" ? "btn-primary" : "btn";
  return <button className={`${base} ${className}`.trim()} {...rest} />;
}
