import { Home, Map, Heart, User } from "lucide-react";

export const navItems = [
  { to: "/", label: "หน้าแรก", icon: Home },
  { to: "/map", label: "แผนที่", icon: Map },
  { to: "/watchlist", label: "ร้านโปรด", icon: Heart },
  { to: "/profile", label: "โปรไฟล์", icon: User },
] as const;
