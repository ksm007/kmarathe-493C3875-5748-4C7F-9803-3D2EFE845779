import { apiDataSource } from '../app/database/data-source';

async function run() {
  await apiDataSource.initialize();
  await apiDataSource.runMigrations();
  await apiDataSource.destroy();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
