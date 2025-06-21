'use client';

/**
 * Sidebar context and hook
 * Extracted to prevent circular dependencies between layout-content and site-sidebar
 */
import { createContext, useContext } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;
  expandSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleSidebar: () => {},
  expandSidebar: () => {}
});

export const useSidebar = () => useContext(SidebarContext);
