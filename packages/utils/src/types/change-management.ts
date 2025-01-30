interface Component {
  id: number;
  name: string;
  description: string | null;
  version: string; // Example: '2.1.4'
  vendor: string | null;
  componentGroupId: number; // Links to ComponentGroup
}

interface ComponentGroup {
  id: number;
  name: string;
  description: string | null;
}

interface ComponentVersion {
  id: number;
  componentId: number;
  version: string; // Example: '2.1.4'
  releaseNotes: string | null;
}

interface ComponentStack {
  id: number;
  name: string;
  description: string | null;
}

interface ComponentStackVersion {
  id: number;
  componentStackId: number;
  components: ComponentVersion[]; // One-to-many
}

interface Server {
  id: number;
  hostname: string;
  ipAddress: string;
  os: string;
  serverGroupId: number | null; // A server can optionally belong to a group
}

interface ServerGroup {
  id: number;
  name: string;
  description: string | null;
}

interface OpsActivity {
  id: number;
  componentId: number;
  componentVersionId: number;
  serverId: number;
  activity: string;
  activityDate: string; // ISO date string
  notes: string | null;
}

interface OpsActivityType {
  id: number;
  name: string;
  description: string | null;
}

interface OpsActivityStatus {
  id: number;
  name: string;
  description: string | null;
}

enum DeploymentGroupActivity {
  CREATED = "Created",
  DELETED = "Deleted",
}

function manageOpsActivity(opsActivity: OpsActivity) {
  /**
   * ### Editing change requests’ deployment groups
   * If a deployment group is deleted, the related ops activity should be Cancelled
   * If a deployment group is added, a new ops activity should be created
   */
  switch (opsActivity.activity) {
    case DeploymentGroupActivity.DELETED:
      opsActivity.activity = "Cancelled";
      break;
    case DeploymentGroupActivity.CREATED:
      opsActivity.activity = "Created";
      break;
    default:
  }

  // Save the updated ops activity
  return opsActivity;
}
