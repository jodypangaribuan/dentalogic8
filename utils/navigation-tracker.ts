// Simple navigation tracker to remember the last visited tab
class NavigationTracker {
  private lastVisitedTab: string = 'home';

  setLastVisitedTab(tab: string) {
    this.lastVisitedTab = tab;
  }

  getLastVisitedTab(): string {
    return this.lastVisitedTab;
  }
}

export const navigationTracker = new NavigationTracker();
