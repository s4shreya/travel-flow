export interface AppNotification {
  id: number;
  title: string;
  body: string;
  created_at: string;
  href?: string | null;
  read: boolean;
}
