import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutUiService {
  sidebarCollapsed = signal(this.readInitialSidebarState());
  mobileMenuOpen = signal(false);

  toggleSidebarCollapsed() {
    const nextValue = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(nextValue);
    localStorage.setItem('base-web-sidebar-collapsed', String(nextValue));
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  private readInitialSidebarState(): boolean {
    try {
      return localStorage.getItem('base-web-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  }
}
