import { expect, it } from 'vitest';
import { sameProject } from '../src/shared/project-location';
const grid = 'https://flow.google.com/u/5/project/project-a';
it('allows editor state while retaining project and account identity', () => {
  expect(sameProject(grid, grid + '?mediaId=image-a')).toBe(true);
  expect(sameProject(grid, grid + '/editor/image-a')).toBe(true);
  expect(sameProject(grid, grid + '#image-a')).toBe(true);
  for (const other of [grid.replace('project-a', 'project-b'), grid.replace('/5/', '/6/'), grid.replace('https:', 'http:'), grid.replace('flow.google.com', 'example.com'), 'https://flow.google.com/u/5/project/project-ab']) expect(sameProject(grid, other)).toBe(false);
});
it('keeps unrecognized route shapes strict', () => {
  expect(sameProject('https://flow.google.com/project-a', 'https://flow.google.com/project-b')).toBe(false);
  expect(sameProject('bad', 'bad')).toBe(false);
});

it('allows the confirmed project-to-edit route without an account prefix', () => {
  const project = 'https://flow.google.com/project/project-a';
  expect(sameProject(project, project + '/edit/image-a')).toBe(true);
  expect(sameProject(project, 'https://flow.google.com/project/project-b/edit/image-a')).toBe(false);
  expect(sameProject(project, 'https://flow.google.com/u/5/project/project-a/edit/image-a')).toBe(false);
});
