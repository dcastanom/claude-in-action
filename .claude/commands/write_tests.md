Write comprehensive tests  for: $ARGUMENTS

Testing conventions:

- Use vitests with React Testing Library
- Place test files in a **tests** directory in the sane folder as the source file
- Name tests files as [filename].test.ts(x)
- Use @/prefix for imports

Covergae:

- Test happy paths
- Test edge cases
- Test error states
- Focus on testing behaiour and public PAI's rather that mplementation details.