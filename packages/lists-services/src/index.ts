// Lists service stubs — implementations pending

export type SendListInviteParams = Record<string, unknown>;
export type AcceptListInviteParams = Record<string, unknown>;
export type DeleteListInviteParams = Record<string, unknown>;

export const createList = async (_input: Record<string, unknown>): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const deleteList = async (_id: string, _userId: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const deleteListItem = async (_listId: string, _itemId: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const removeUserFromList = async (_listId: string, _userId: string, _removedBy: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const updateList = async (_id: string, _data: Record<string, unknown>): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getAllUserListsWithPlaces = async (_userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const getListById = async (_id: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getPlaceLists = async (_placeId: string, _userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const getListOwnedByUser = async (_listId: string, _userId: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const addItemToList = async (_listId: string, _item: Record<string, unknown>): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getItemsByListId = async (_listId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const removeItemFromList = async (_listId: string, _itemId: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

// Invite operations
export const acceptListInvite = async (_params: AcceptListInviteParams): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const deleteInviteByListAndToken = async (_listId: string, _token: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const deleteListInvite = async (_params: DeleteListInviteParams): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const getInviteByListAndToken = async (_listId: string, _token: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getInviteByToken = async (_token: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getInvitesForUser = async (_userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const getPlaceListPreview = async (_placeId: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getListInvites = async (_listId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const getOutboundInvites = async (_userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const isUserMemberOfList = async (_userId: string, _listId: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const sendListInvite = async (_params: SendListInviteParams): Promise<unknown> => {
  throw new Error('Not implemented');
};
