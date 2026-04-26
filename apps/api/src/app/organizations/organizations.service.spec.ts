import { Role } from '@nx-temp/data';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  it('returns only the current organization for non-owner roles', async () => {
    const repository = {
      find: jest.fn(),
    };
    const service = new OrganizationsService(repository as never);

    await expect(service.getAccessibleOrganizationIds(Role.Admin, 'org-1')).resolves.toEqual(['org-1']);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('includes direct children for owners', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]),
    };
    const service = new OrganizationsService(repository as never);

    await expect(service.getAccessibleOrganizationIds(Role.Owner, 'org-1')).resolves.toEqual([
      'org-1',
      'org-2',
    ]);
  });
});
