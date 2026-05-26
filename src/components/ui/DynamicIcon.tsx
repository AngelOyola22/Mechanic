import React from 'react';
import { 
  CircleDot, 
  Wrench, 
  UsersRound, 
  ShieldCheck, 
  AppWindow, 
  Blocks, 
  Receipt, 
  ShoppingBasket, 
  ClipboardList, 
  Contact, 
  Store, 
  Warehouse, 
  Settings,
  Layers,
  MonitorPlay,
  Car,
  CarFront,
  Tag,
  Scale,
  FileText,
  LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  CircleDot,
  Wrench,
  UsersRound,
  ShieldCheck,
  AppWindow,
  Blocks,
  Receipt,
  ShoppingBasket,
  ClipboardList,
  Contact,
  Store,
  Warehouse,
  Settings,
  Layers,
  MonitorPlay,
  Car,
  CarFront,
  Tag,
  Scale,
  FileText
};

interface DynamicIconProps {
  name?: string | null;
  className?: string;
  defaultIcon?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className, defaultIcon = 'CircleDot' }) => {
  const iconName = name || defaultIcon;
  const Icon = iconMap[iconName];
  
  if (!Icon) {
    const DefaultIcon = iconMap[defaultIcon] || CircleDot;
    return <DefaultIcon className={className} />;
  }

  return <Icon className={className} />;
};
