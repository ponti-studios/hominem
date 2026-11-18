import { requireNativeModule } from 'expo';

export type SpotlightItemKind = 'chat' | 'note';

export interface SpotlightItem {
  id: string;
  kind: SpotlightItemKind;
  title: string;
  body?: string | null;
  updatedAt?: string | null;
}

export type OmiroSystemModuleType = {
  // The app path (for example `chat/<id>` or `task/add`) of the quick action or
  // Spotlight result that opened the app before JavaScript was listening.
  consumePendingLink(): string | null;
  indexSpotlightItems(items: SpotlightItem[]): Promise<void>;
  // Identifiers are `<kind>:<id>`.
  removeSpotlightItems(identifiers: string[]): Promise<void>;
  clearSpotlight(): Promise<void>;
  recognizeText(uri: string): Promise<string>;
  // Returns the file URL of the PDF.
  renderPdf(fileName: string, html: string): Promise<string>;
  addListener(
    eventName: 'onLink',
    listener: (event: { path: string }) => void,
  ): { remove: () => void };
};

export default requireNativeModule<OmiroSystemModuleType>('OmiroSystem');
