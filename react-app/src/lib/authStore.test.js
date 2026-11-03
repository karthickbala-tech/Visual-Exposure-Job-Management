import { ROLES } from '../data/mockData';
import { demoAccounts, listUsers, setUserRole } from './authStore';

test('browsers seeded before the new roles get the missing demo accounts, and an Admin can change a role', async () => {
  const old = Object.keys(ROLES).slice(0, 6).map((roleId) => ({ id: `u-${roleId}`, name: ROLES[roleId].name, email: `${roleId}@x.test`, roleId, salt: 's', hash: 'h' }));
  localStorage.setItem('ve-auth-users', JSON.stringify(old));
  const users = await listUsers();
  expect(users).toHaveLength(11);
  expect(demoAccounts.map((a) => a.roleId)).toEqual(Object.keys(ROLES));
  expect(users.find((u) => u.roleId === 'admin').name).toBe('Karen Wells');
  expect(users[0].hash).toBeUndefined(); // password hashes never leave the store

  await setUserRole('u-installer', 'contractor');
  expect((await listUsers()).find((u) => u.id === 'u-installer').roleId).toBe('contractor');
  await expect(setUserRole('u-installer', 'nope')).rejects.toThrow(/does not exist/);
  await expect(setUserRole('nobody', 'admin')).rejects.toThrow(/does not exist/);
  localStorage.clear();
});
