// markdown-it-task-lists ships no types. The `paths` in jsconfig.json point the import here, so
// TypeScript does not read the plugin's JavaScript.
import type MarkdownIt from 'markdown-it';

declare const taskLists: MarkdownIt.PluginWithOptions<{
  enabled?: boolean;
  label?: boolean;
  labelAfter?: boolean;
}>;
export default taskLists;
