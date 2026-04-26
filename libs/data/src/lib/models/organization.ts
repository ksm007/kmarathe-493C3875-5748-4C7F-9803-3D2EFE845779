export interface Organization {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  level: number;
  createdAt: string;
  updatedAt: string;
}
