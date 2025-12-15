/**
 * Detect and parse comment events from webhooks
 * Supports Facebook/Instagram webhooks and mock events
 */
export function detectCommentEvent(body: any): {
  isComment: boolean;
  platform: string | null;
  data: any;
} {
  // Handle Facebook/Instagram webhook format
  if (body?.entry) {
    for (const entry of body.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          const { field, value } = change;
          
          // Check if this is a comment event
          if (field === 'feed' && value?.item === 'comment') {
            return {
              isComment: true,
              platform: 'facebook',
              data: {
                pageId: entry.id,
                commentId: value.id,
                postId: value.post_id,
                content: value.message,
                authorId: value.from?.id,
                authorName: value.from?.name,
                createdTime: value.created_time,
                permalink: value.permalink_url,
              },
            };
          }
        }
      }
    }
  }
  
  // Handle mock/test comment format for development
  if (body?.mock === true && body?.comment) {
    return {
      isComment: true,
      platform: body.platform || 'facebook',
      data: {
        pageId: body.pageId,
        commentId: body.comment.id,
        postId: body.comment.postId || body.postId,
        content: body.comment.content,
        authorId: body.comment.authorId,
        authorName: body.comment.authorName,
        createdTime: body.comment.createdTime || new Date().toISOString(),
        permalink: body.comment.permalink,
      },
    };
  }

  return {
    isComment: false,
    platform: null,
    data: null,
  };
}
