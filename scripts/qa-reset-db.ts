import { runQaDatabaseResetCli } from '../src/common/qa-db-reset';

runQaDatabaseResetCli().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
