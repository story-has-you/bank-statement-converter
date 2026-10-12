import type { ComponentProps, FC } from "react";

import type { PaymentProviderId } from "@/lib/billing/provider";

// Brand vectors: Creem's official icon and PayPal from Simple Icons (CC0).
// https://www.creem.io/new-branding/Logo/SVG/creem%20logo%20icon_black.svg
// https://cdn.simpleicons.org/paypal
const icons = {
  creem: {
    viewBox: "0 0 121 121",
    path: "M22.1102 11C24.1187 11.0001 25.9669 12.0982 26.9281 13.8619L51.2059 58.4106C52.5699 60.9134 55.7048 61.8368 58.2077 60.473C60.7108 59.109 61.6342 55.9742 60.2701 53.4712L41.5466 19.113C39.554 15.4566 42.2004 11 46.3645 11H103.806C107.885 11 110.539 15.2933 108.715 18.9416L65.0579 106.254C63.0356 110.298 57.2654 110.298 55.2431 106.254L11.5863 18.9416C9.76212 15.2933 12.4156 11 16.4946 11H22.1102Z",
  },
  paypal: {
    viewBox: "0 0 24 24",
    path: "M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z",
  },
} satisfies Record<PaymentProviderId, { viewBox: string; path: string }>;

type PaymentProviderIconProps = ComponentProps<"svg"> & { provider: PaymentProviderId };

/** Renders a decorative payment brand icon using the surrounding text color. */
const PaymentProviderIcon: FC<PaymentProviderIconProps> = ({ provider, ...props }) => {
  const icon = icons[provider];

  return (
    <svg viewBox={icon.viewBox} fill="currentColor" aria-hidden="true" {...props}>
      <path d={icon.path} />
    </svg>
  );
};

PaymentProviderIcon.displayName = "PaymentProviderIcon";

export { PaymentProviderIcon };
