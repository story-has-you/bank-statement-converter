import Image from "next/image";

type BrandLogoProps = { className?: string };

export function BrandLogo({ className }: BrandLogoProps) {
  return <Image src="/logo.svg" alt="" width={40} height={40} unoptimized className={className} aria-hidden="true" />;
}
