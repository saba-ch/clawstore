import type { LucideProps } from "lucide-react"
import {
  Briefcase,
  Code,
  Heart,
  DollarSign,
  MessageSquare,
  Play,
  Pencil,
  Search,
  BarChart3,
  Headphones,
  Box,
  Folder,
  BookOpen,
  Shield,
  Gamepad2,
  Image,
  Music,
  Globe,
  Wrench,
  Lightbulb,
  GraduationCap,
  ShoppingCart,
  Truck,
  Cpu,
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  briefcase: Briefcase,
  code: Code,
  heart: Heart,
  dollar: DollarSign,
  chat: MessageSquare,
  play: Play,
  pencil: Pencil,
  search: Search,
  chart: BarChart3,
  headset: Headphones,
  box: Box,
  book: BookOpen,
  shield: Shield,
  gamepad: Gamepad2,
  image: Image,
  music: Music,
  globe: Globe,
  wrench: Wrench,
  lightbulb: Lightbulb,
  education: GraduationCap,
  shopping: ShoppingCart,
  truck: Truck,
  cpu: Cpu,
}

export function CategoryIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = iconMap[name.toLowerCase()] ?? Folder
  return <Icon className={className} />
}
