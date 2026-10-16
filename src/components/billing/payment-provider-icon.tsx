import type { ComponentProps, FC } from "react";
import type { PaymentProviderId } from "@/lib/billing/provider";

// Brand vector: Creem's official icon.
// https://www.creem.io/new-branding/Logo/SVG/creem%20logo%20icon_black.svg
type PaymentProviderIconProps = ComponentProps<"svg"> & { provider: PaymentProviderId };

/** Renders a decorative payment brand icon using the surrounding text color. */
const PaymentProviderIcon: FC<PaymentProviderIconProps> = ({ provider, ...props }) => {
  if (provider === "paypal") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
        <path d="M7.08 2.02h6.43c4.18 0 6.1 2.09 5.47 5.9-.69 4.13-3.31 6.24-7.79 6.24H8.94L7.8 21.38H3.71L6.57 2.46a.52.52 0 0 1 .51-.44Zm2.43 4.02-.63 4.13h2.3c2.03 0 3.16-.76 3.4-2.26.21-1.34-.65-1.87-2.37-1.87h-2.7Z" />
        <path
          opacity=".55"
          d="M19.81 8.4c1.37.93 1.85 2.53 1.48 4.76-.62 3.73-3.01 5.64-7.05 5.64h-1.7l-.82 5.2H8.04l1.32-8.35h1.83c4.81 0 7.77-2.44 8.62-7.25Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 121 121" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22.1102 11C24.1187 11.0001 25.9669 12.0982 26.9281 13.8619L51.2059 58.4106C52.5699 60.9134 55.7048 61.8368 58.2077 60.473C60.7108 59.109 61.6342 55.9742 60.2701 53.4712L41.5466 19.113C39.554 15.4566 42.2004 11 46.3645 11H103.806C107.885 11 110.539 15.2933 108.715 18.9416L65.0579 106.254C63.0356 110.298 57.2654 110.298 55.2431 106.254L11.5863 18.9416C9.76212 15.2933 12.4156 11 16.4946 11H22.1102Z" />
    </svg>
  );
};

PaymentProviderIcon.displayName = "PaymentProviderIcon";

export { PaymentProviderIcon };
