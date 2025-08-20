export interface Event {
  id?: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  googleCalendarId?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

