## ADDED Requirements

### Requirement: Image attachments show thumbnail previews

Image attachments SHALL display thumbnail previews instead of text labels.

#### Scenario: Image attachment shows thumbnail
- **WHEN** user attaches an image
- **THEN** a thumbnail (48x48px) of the image is displayed
- **AND** the thumbnail has rounded corners (borderRadius: 4)

### Requirement: Attachment thumbnail shows upload progress

Attachments that are uploading SHALL display a progress indicator over the thumbnail.

#### Scenario: Upload shows progress
- **WHEN** an attachment is uploading
- **THEN** a circular or linear progress indicator overlays the thumbnail
- **AND** the progress percentage is not shown (just the indicator)

### Requirement: Failed uploads show retry option

Attachments that fail to upload SHALL display an error state with retry option.

#### Scenario: Failed upload can be retried
- **WHEN** an attachment upload fails
- **THEN** the thumbnail shows an error indicator (e.g., red tint)
- **AND** tapping the thumbnail retries the upload

### Requirement: Multiple attachments show count badge

When multiple attachments are selected, the composer SHALL show a count badge if space is limited.

#### Scenario: Multiple attachments badge
- **WHEN** user selects 5 or more attachments
- **THEN** the displayed attachments show a "+N" badge
- **AND** tapping the badge expands to show all attachments
