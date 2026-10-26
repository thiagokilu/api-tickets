export const TICKET_INCLUDE = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    } as const;
