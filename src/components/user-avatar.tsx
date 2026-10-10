import { UserRoundIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = { imageUrl: string | null; alt: string; className?: string };

export function UserAvatar({ imageUrl, alt, className }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {imageUrl && <AvatarImage src={imageUrl} alt={alt} />}
      <AvatarFallback><UserRoundIcon className="size-4" aria-hidden="true" /></AvatarFallback>
    </Avatar>
  );
}
