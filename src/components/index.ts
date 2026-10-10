/**
 * The components of every category. Importing this module registers every tag it defines;
 * `define()` leaves a tag another bundle already defined alone. The modal's and the toast's
 * events are stopped by the content tiles and `<lintje-shell>`, so one action is one line in a
 * host's log. Put one filter bar on a page: two would both write the count in the mobile header
 * and both own the sheet.
 */
import './frame/shell/shell'
import './frame/user-menu/user-menu'
import './frame/page-header/page-header'
import './filters/filter-bar/filter-bar'
import './feedback/announcement/announcement'
import './charts/chart/chart'
import './chat/chat/chat'
import './chat/chat-answer/chat-answer'
import './chat/chat-composer/chat-composer'
import './chat/chat-message/chat-message'
import './chat/chat-strip/chat-strip'
import './chat/chat-suggestions/chat-suggestions'
import './content/code/code'
import './tables/data-table/data-table'
import './layout/expander/expander'
import './charts/explainer/explainer'
import './charts/kpi/kpi'
import './charts/kpi-row/kpi-row'
import './map/map/map'
import './overlays/modal/modal'
import './charts/note/note'
import './content/prose/prose'
import './feedback/toast/toast'
import './overlays/toggletip/toggletip'
import './inputs/checkbox/checkbox'
import './inputs/number-input/number-input'
import './inputs/radio-group/radio-group'
import './inputs/text-input/text-input'
import './inputs/toggle/toggle'
import './actions/logo/logo'
import './inputs/field/field'
import './inputs/segmented/segmented'
import './inputs/select/select'
import './inputs/multiselect/multiselect'
import './inputs/range/range'
import './inputs/date-range/date-range'
import './filters/filter-zone/filter-zone'
import './filters/filter-sheet/filter-sheet'
import './forms/form/form'
import './forms/form-section/form-section'
import './forms/error-summary/error-summary'
import './forms/form-actions/form-actions'
import './overlays/confirm-dialog/confirm-dialog'
import './inputs/textarea/textarea'
import './inputs/file-upload/file-upload'
import './inputs/combobox/combobox'
import './inputs/tag-input/tag-input'
import './inputs/date-input/date-input'
import './inputs/time-input/time-input'
import './inputs/text-editor/text-editor'
import './inputs/slot-picker/slot-picker'
import './forms/repeater/repeater'
import './layout/tabs/tabs'
import './frame/hero/hero'
import './content/translator/translator'
import './forms/stepper/stepper'
import './layout/split-pane/split-pane'
import './overlays/drawer/drawer'
import './actions/menu-button/menu-button'
import './frame/breadcrumbs/breadcrumbs'
import './feedback/level-meter/level-meter'
import './feedback/recording-status/recording-status'
import './frame/sub-nav/sub-nav'
import './tables/pagination/pagination'
import './tables/list/list'
import './tables/card/card'
import './tables/card-list/card-list'
import './content/gallery/gallery'
import './frame/footer/footer'
import './tables/tree-view/tree-view'
import './tables/sortable-list/sortable-list'
import './tables/description-list/description-list'
import './feedback/empty-state/empty-state'
import './tables/activity-log/activity-log'
import './actions/copy-button/copy-button'
import './actions/qr-code/qr-code'
import './feedback/ai-label/ai-label'
import './content/highlight/highlight'
import './feedback/job-list/job-list'
import './feedback/streaming-text/streaming-text'
import './content/audio-player/audio-player'
import './content/video-player/video-player'
import './content/transcript/transcript'
import './content/document-viewer/document-viewer'
import './feedback/conflict-alert/conflict-alert'
import './frame/app-search/app-search'
import './frame/shortcuts/shortcuts'
import './frame/session-expiry/session-expiry'
import './frame/notifications/notifications'

export { LintjeAnnouncement } from './feedback/announcement/announcement'
export { LintjeChart } from './charts/chart/chart'
export { LintjeChat } from './chat/chat/chat'
export { LintjeChatAnswer } from './chat/chat-answer/chat-answer'
export type { ChatRating } from './chat/chat-answer/chat-answer'
export { LintjeChatComposer } from './chat/chat-composer/chat-composer'
export type { ChatComposerVariant, ChatSendKey } from './chat/chat-composer/chat-composer'
export { LintjeChatMessage } from './chat/chat-message/chat-message'
export { completions, recogniseTerms, termParts, wordBefore } from './chat/shared/chat-terms'
export type { ChatTextPart } from './chat/shared/chat-terms'
export { LintjeChatStrip } from './chat/chat-strip/chat-strip'
export { LintjeChatSuggestions } from './chat/chat-suggestions/chat-suggestions'
export type { ChatSuggestionKind } from './chat/chat-suggestions/chat-suggestions'
export { LintjeCode } from './content/code/code'
export { LintjeContentTileElement } from './shared/content-tile'
export type { ExpandModalOptions } from './shared/content-tile'
export { LintjeDataTable } from './tables/data-table/data-table'
export { LintjeExpander } from './layout/expander/expander'
export { LintjeExplainer } from './charts/explainer/explainer'
export { LintjeKpi } from './charts/kpi/kpi'
export { LintjeKpiRow } from './charts/kpi-row/kpi-row'
export { LintjeMap } from './map/map/map'
export { LintjeModal } from './overlays/modal/modal'
export { LintjeNote } from './charts/note/note'
export { LintjeProse } from './content/prose/prose'
export type { ProseTone } from './content/prose/prose'
export { LintjeToast } from './feedback/toast/toast'
export { LintjeToggletip } from './overlays/toggletip/toggletip'
export type { ToggletipPlacement } from './overlays/toggletip/toggletip'

export { LintjeInputElement } from './inputs/shared/input'
export type { InputValue } from './inputs/shared/input'
export { LintjeCheckbox } from './inputs/checkbox/checkbox'
export { LintjeNumberInput } from './inputs/number-input/number-input'
export { LintjeRadioGroup } from './inputs/radio-group/radio-group'
export { LintjeTextInput } from './inputs/text-input/text-input'
export { LintjeToggle } from './inputs/toggle/toggle'
export { LintjeLogo } from './actions/logo/logo'
export { LintjeField } from './inputs/field/field'
export { LintjeSegmented } from './inputs/segmented/segmented'
export { LintjeSelect } from './inputs/select/select'
export { LintjeMultiselect } from './inputs/multiselect/multiselect'
export { LintjeRange } from './inputs/range/range'
export { LintjeDateRange, formatDate } from './inputs/date-range/date-range'
export type { DateRange } from './inputs/date-range/date-range'
export { LintjeFilterZone } from './filters/filter-zone/filter-zone'
export { LintjeFilterSheet } from './filters/filter-sheet/filter-sheet'
export { filterSentence, sentenceText } from './filters/shared/sentence'
export type { SentencePart } from './filters/shared/sentence'

export { LintjeForm, readDraft, DRAFT_PREFIX } from './forms/form/form'
export type { FormValues, FormErrors, StoredDraft } from './forms/form/form'
export { LintjeFormSection } from './forms/form-section/form-section'
export type { FormSectionVariant } from './forms/form-section/form-section'
export { LintjeErrorSummary } from './forms/error-summary/error-summary'
export type { ErrorSummaryItem } from './forms/error-summary/error-summary'
export { LintjeFormActions } from './forms/form-actions/form-actions'
export type { FormActionsState } from './forms/form-actions/form-actions'
export { LintjeConfirmDialog } from './overlays/confirm-dialog/confirm-dialog'
export type { ConfirmTone, ConfirmCloseReason } from './overlays/confirm-dialog/confirm-dialog'

export { LintjeTextarea } from './inputs/textarea/textarea'
export { LintjeFileUpload } from './inputs/file-upload/file-upload'
export type { UploadFile } from './inputs/file-upload/file-upload'
export { LintjeCombobox } from './inputs/combobox/combobox'
export { LintjeTagInput } from './inputs/tag-input/tag-input'
export { LintjeDateInput } from './inputs/date-input/date-input'
export { LintjeTimeInput } from './inputs/time-input/time-input'
export { LintjeTextEditor } from './inputs/text-editor/text-editor'
export type { EditorFormat } from './inputs/text-editor/text-editor'
export { LintjeSlotPicker } from './inputs/slot-picker/slot-picker'
export type { SlotDay, TimeSlot } from './inputs/slot-picker/slot-picker'
export { LintjeRepeater, LintjeRepeaterRow } from './forms/repeater/repeater'

export { LintjeTabs } from './layout/tabs/tabs'
export type { TabItem, TabsVariant } from './layout/tabs/tabs'
export { LintjeHero } from './frame/hero/hero'
export { LintjeTranslator } from './content/translator/translator'
export { LintjeStepper } from './forms/stepper/stepper'
export type { Step, StepState } from './forms/stepper/stepper'
export { LintjeSplitPane } from './layout/split-pane/split-pane'
export type { SplitPaneSide } from './layout/split-pane/split-pane'
export { LintjeDrawer } from './overlays/drawer/drawer'
export type { DrawerCloseReason } from './overlays/drawer/drawer'
export { LintjeMenuButton } from './actions/menu-button/menu-button'
export type {
  MenuEntry,
  MenuHeading,
  MenuItem,
  MenuButtonVariant,
} from './actions/menu-button/menu-button'
export { LintjeBreadcrumbs } from './frame/breadcrumbs/breadcrumbs'
export type { Crumb } from './frame/breadcrumbs/breadcrumbs'
export { LintjeLevelMeter } from './feedback/level-meter/level-meter'
export { LintjeRecordingStatus } from './feedback/recording-status/recording-status'
export type { RecordingConnection } from './feedback/recording-status/recording-status'
export { LintjeSubNav } from './frame/sub-nav/sub-nav'
export type { SubNavAction, SubNavGroup, SubNavItem } from './frame/sub-nav/sub-nav'
export { LintjePagination, pageRange } from './tables/pagination/pagination'
export type { PageSlot } from './tables/pagination/pagination'
export { LintjeList } from './tables/list/list'
export type { ListItem, RowClickDetail } from './tables/list/list'
export { LintjeCard } from './tables/card/card'
export type {
  CardAction,
  CardData,
  CardFact,
  CardLayout,
  CardMedia,
  CardStatus,
  CardStatusTone,
} from './tables/card/card'
export { LintjeCardList } from './tables/card-list/card-list'
export { LintjeGallery } from './content/gallery/gallery'
export type { GalleryItem } from './content/gallery/gallery'
export { LintjeFooter } from './frame/footer/footer'
export type { FooterColumn, FooterData, FooterLink } from './frame/footer/footer'
export { LintjeTreeView } from './tables/tree-view/tree-view'
export type { TreeNode } from './tables/tree-view/tree-view'
export { LintjeSortableList } from './tables/sortable-list/sortable-list'
export type { SortableItem } from './tables/sortable-list/sortable-list'
export { LintjeDescriptionList } from './tables/description-list/description-list'
export type { DescriptionItem, DescriptionAction } from './tables/description-list/description-list'
export { LintjeEmptyState } from './feedback/empty-state/empty-state'
export { LintjeActivityLog } from './tables/activity-log/activity-log'
export type { ActivityEntry } from './tables/activity-log/activity-log'

export { LintjeCopyButton } from './actions/copy-button/copy-button'
export { LintjeQrCode } from './actions/qr-code/qr-code'
export { LintjeAiLabel } from './feedback/ai-label/ai-label'
export { LintjeHighlight } from './content/highlight/highlight'
export type { HighlightKind } from './content/highlight/highlight'
export { LintjeJobList } from './feedback/job-list/job-list'
export type { Job, JobState } from './feedback/job-list/job-list'
export { LintjeStreamingText } from './feedback/streaming-text/streaming-text'
export type { StreamState } from './feedback/streaming-text/streaming-text'
export { LintjeConflictAlert } from './feedback/conflict-alert/conflict-alert'
export type { ConflictChange, ConflictChoice } from './feedback/conflict-alert/conflict-alert'

export { LintjeAudioPlayer } from './content/audio-player/audio-player'
// A host that names speakers beside the player gives them the same colours.
export { speakerColours, SPEAKER_COLOURS } from './content/audio-player/playback'
export type { SpeakerColour } from './content/audio-player/playback'
export { LintjeVideoPlayer } from './content/video-player/video-player'
export type { TimedText } from './content/video-player/video-player'
export { LintjeTranscript } from './content/transcript/transcript'
export type {
  TranscriptSegment,
  TranscriptMatches,
  TranscriptMatch,
} from './content/transcript/transcript'
export { LintjeDocumentViewer } from './content/document-viewer/document-viewer'
export type { ZoomLevel } from './content/document-viewer/document-viewer'

export { LintjeAppSearch } from './frame/app-search/app-search'
export type { SearchGroup, SearchResult, AppSearchCloseReason } from './frame/app-search/app-search'
export { LintjeShortcuts } from './frame/shortcuts/shortcuts'
export type { ShortcutsCloseReason } from './frame/shortcuts/shortcuts'
export { LintjeSessionExpiry } from './frame/session-expiry/session-expiry'
export type { SessionPhase, RestoredReason } from './frame/session-expiry/session-expiry'
export { LintjeNotifications } from './frame/notifications/notifications'
export type { NotificationItem } from './frame/notifications/notifications'

export { MediaController, MOBILE, WIDE } from '../core/media'
export { setHostConfig, scrollRoot } from '../core/host-config'
export type { HostConfig } from '../core/host-config'
export { toCsv, downloadCsv, downloadPng } from './shared/download'
export type { CsvCell } from './shared/download'

export type {
  AnnouncementData,
  AnnouncementKind,
  AnnouncementViewData,
  CellValue,
  ChartData,
  DataTableData,
  ExplainerData,
  KpiData,
  KpiRowData,
  MapData,
  NoteData,
  SortState,
  TableColumnData,
  TileData,
} from '../types'

export { LintjeShell } from './frame/shell/shell'
export { LintjeUserMenu } from './frame/user-menu/user-menu'
export { LintjePageHeader } from './frame/page-header/page-header'
export { LintjeFilterBar } from './filters/filter-bar/filter-bar'
export type {
  FilterBarData,
  FilterDefinition,
  FilterKind,
  FilterOption,
  FilterValue,
  ModeSetting,
  PageHeaderData,
  ShellData,
  ShellGroup,
  ShellLink,
  ShellView,
  ShellViewChange,
  UserMenuUser,
} from '../types'
