// Places service stubs — implementations pending

export interface PlaceInput {
  googleMapsId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location: [number, number];
  types: string[] | null;
  rating: number | null;
  websiteUri: string | null;
  phoneNumber: string | null;
  photos: string[] | null;
  imageUrl: string | null;
}

export interface PlaceRecord {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  googleMapsId: string;
  rating: number | null;
  priceLevel: number | null;
  photos: string[] | null;
  types: string[] | null;
  websiteUri: string | null;
  phoneNumber: string | null;
  businessStatus: string | null;
  openingHours: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const addPlaceToLists = async (
  _userId: string,
  _listIds: string[],
  _placeData: PlaceInput,
): Promise<{ place: PlaceRecord; lists: unknown[] }> => {
  throw new Error('Not implemented');
};

export const createOrUpdatePlace = async (_id: string, _data: Partial<PlaceInput>): Promise<PlaceRecord | null> => {
  throw new Error('Not implemented');
};

export const deletePlaceById = async (_id: string): Promise<boolean> => {
  throw new Error('Not implemented');
};

export const getPlaceById = async (_id: string): Promise<PlaceRecord | null> => {
  throw new Error('Not implemented');
};

export const getPlaceByGoogleMapsId = async (_googleMapsId: string): Promise<PlaceRecord | null> => {
  throw new Error('Not implemented');
};

export const getPlacePhotoById = async (_id: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const addItemToTrip = async (_tripId: string, _item: Record<string, unknown>): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const createTrip = async (_input: Record<string, unknown>): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getAllTrips = async (_userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};

export const getTripById = async (_id: string): Promise<unknown> => {
  throw new Error('Not implemented');
};

export const getNearbyPlacesFromLists = async (_input: {
  userId: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}): Promise<Array<PlaceRecord & { distance?: number | { km?: number; miles?: number }; lists?: unknown[] }>> => {
  throw new Error('Not implemented');
};

export const removePlaceFromList = async (_input: {
  placeId: string;
  listId: string;
  userId: string;
}): Promise<void> => {
  throw new Error('Not implemented');
};

export const googlePlaces = {
  autocomplete: async (_input: Record<string, unknown>): Promise<Array<{
    placePrediction?: {
      placeId?: string;
      id?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
      displayName?: { text?: string };
      formattedAddress?: string;
    };
  }>> => {
    throw new Error('Not implemented');
  },
  getDetails: async (_input: { placeId: string; forceFresh?: boolean }): Promise<{
    photos?: Array<string | { name?: string }>;
    rating?: number;
    types?: string[];
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    websiteUri?: string;
    nationalPhoneNumber?: string;
  } | null> => {
    throw new Error('Not implemented');
  },
};

export const isGooglePhotosUrl = (_url: string): boolean => false;
