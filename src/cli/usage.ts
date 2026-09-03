export const usageText = `Usage:
  mutate4ts <file.ts|tsx|js|jsx>                      Mutate one TypeScript or React source file
  mutate4ts <file> --scan                            Print mutation-site scan without running tests
  mutate4ts <file> --update-manifest                 Write embedded manifest without running tests
  mutate4ts <file> --reuse-coverage                  Reuse existing Istanbul coverage without refreshing it
  mutate4ts <file> --lines 12,18                     Restrict mutations to specific source lines
  mutate4ts <file> --since-last-run                  Mutate only scopes changed since embedded manifest
  mutate4ts <file> --mutate-all                      Ignore embedded manifest and mutate all covered sites
  mutate4ts <file> --mutation-warning 50             Warn when selected mutation count exceeds threshold
  mutate4ts <file> --max-workers 4                   Limit parallel worker count
  mutate4ts <file> --timeout-factor 15               Set mutant timeout as baseline multiplier
  mutate4ts <file> --test-command CMD                Override the test command used for baseline and mutants
  mutate4ts <file> --verbose                         Print live worker progress
  mutate4ts --help                                   Print this help message
`;
