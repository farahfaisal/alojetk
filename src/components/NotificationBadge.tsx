import React from 'react';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';

interface NotificationBadgeProps {
  onClick: () => void;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 flex items-center justify-center bg-accent/10 rounded-lg text-accent hover:bg-accent/20 transition-colors"
    >
      <Bell className="w-5 h-5" />
    </button>
  );
};

export default NotificationBadge;