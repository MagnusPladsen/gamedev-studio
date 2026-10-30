-- Voxel models: one asset per 3D model made in the Voxels tool.
alter table public.assets drop constraint if exists assets_collection_check;
alter table public.assets add constraint assets_collection_check check (collection in (
  'sprites', 'sounds', 'music', 'diagrams', 'stories', 'tilemaps', 'dialogues',
  'palettes', 'spritesheets', 'notes', 'boards', 'issues', 'models', 'links'));
