import type { FC } from "react";

interface OroLogoProps {
  size?: number;
  className?: string;
}

export const OroLogo: FC<OroLogoProps> = ({ size = 54, className }) => {
  return (
    <img
      src="/logo.svg"
      alt="Oro Logo"
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        objectFit: "contain",
      }}
    />
  );
};
