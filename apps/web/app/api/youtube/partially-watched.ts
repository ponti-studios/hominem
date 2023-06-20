import { NextApiRequest,NextApiResponse } from "next";
import { google } from 'googleapis';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL } = process.env;

// This function retrieves the partially watched videos from a user's YouTube history
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { videoId } = req.query;
    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URL
    );


  try {
    // Get the user's access token from the request headers
    const accessToken = req.headers.authorization.split(' ')[1];

    // Set the access token for the OAuth2 client
    oauth2Client.setCredentials({ access_token: accessToken });

    // Use the YouTube Data API to retrieve the user's watch history
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    // const history = await youtube.activities.list({
    //   mine: true,
    //   maxResults: 50,
    //   fields: 'items(contentDetails)',
    //   filter: 'historyType=watched',
    // });
    const history = await youtube.activities.list({
        mine: true,
        maxResults: 50,
        part: ['snippet', 'contentDetails']
    });

    // Filter the history to only include partially watched videos
    const partiallyWatchedVideos = history.data.items.filter(
      (item) => item.contentDetails.progressPercentage > 0 && item.contentDetails.progressPercentage < 100
    );

    // Extract the video IDs from the partially watched videos
    const videoIds = partiallyWatchedVideos.map((item) => item.contentDetails.videoId);

    // Use the YouTube Data API to retrieve the details of the partially watched videos
    const videos = await youtube.videos.list({
      part: 'snippet',
      id: videoIds.join(','),
    });

    res.status(200).json(videos.data.items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
}