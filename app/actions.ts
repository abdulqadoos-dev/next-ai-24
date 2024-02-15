'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { kv } from '@vercel/kv'

import { auth } from '@/auth'
import { type Chat } from '@/lib/types'

import { Client, connect } from '@/lib/database/redis';


export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  await connect();

  // kv

  // try {
  //   const pipeline = kv.pipeline()
  //   const chats: string[] = await kv.zrange(`user:chat:${userId}`, 0, -1, {
  //     rev: true
  //   })

  //   for (const chat of chats) {
  //     pipeline.hgetall(chat)
  //   }

  //   const results = await pipeline.exec()

  //   return results as Chat[]
  // } catch (error) {
  //   return []
  // }

  try {
    const chats: string[] = await Client.zRange(`user:chat:${userId}`, 0, -1, { REV: true })
    let getChats = []
    for (const chat of chats) {
      const response = await Client.hGetAll(chat)
      response?.chat ? getChats.push(JSON.parse(response.chat)) : null
    }
    return getChats as Chat[]

  } catch (error) {
    return []
  }
}

export async function getChat(id: string, userId: string) {


  await connect();
  const response = await Client.hGetAll(`chat:${id}`)
  const chat = response.chat ? JSON.parse(response.chat) : null
  if (!chat || (userId && chat.userId !== userId)) {
    return null
  }
  return chat

  // const chat = await kv.hgetall<Chat>(`chat:${id}`)

  // if (!chat || (userId && chat.userId !== userId)) {
  //   return null
  // }

  // return chat

}

export async function removeChat({ id, path }: { id: string; path: string }) {
  
  
  const session = await auth()

  if (!session) {
    return {
      error: 'Unauthorized'
    }
  }

  await connect();


  const chat = await Client.hGet(`chat:${id}`, 'chat')
  const uid = chat? JSON.parse(chat).userId : null

  if (uid !== session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }


  await Client.hDel(`chat:${id}`, 'chat')
  await Client.zRem(`user:chat:${session.user.id}`, `chat:${id}`)
  revalidatePath('/')
  return revalidatePath(path)
  
  // kv

  // const session = await auth()

  // if (!session) {
  //   return {
  //     error: 'Unauthorized'
  //   }
  // }

  // //Convert uid to string for consistent comparison with session.user.id
  // const uid = String(await kv.hget(`chat:${id}`, 'userId'))

  // if (uid !== session?.user?.id) {
  //   return {
  //     error: 'Unauthorized'
  //   }
  // }

  // await kv.del(`chat:${id}`)
  // await kv.zrem(`user:chat:${session.user.id}`, `chat:${id}`)

  // revalidatePath('/')
  // return revalidatePath(path)


}

export async function clearChats() {

  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'Unauthorized'
    }
  }

  
  await connect();

  const chats: string[] = await Client.zRange(`user:chat:${session.user.id}`, 0, -1, {REV: true})

  if (!chats.length) {
  return redirect('/')
  }


  for (const chat of chats) {
    await Client.hDel(chat, 'chat')
    await Client.zRem(`user:chat:${session.user.id}`, chat)
  }


  revalidatePath('/')
  return redirect('/')

  // kv
  // const session = await auth()

  // if (!session?.user?.id) {
  //   return {
  //     error: 'Unauthorized'
  //   }
  // }

  // const chats: string[] = await kv.zrange(`user:chat:${session.user.id}`, 0, -1)
  // if (!chats.length) {
  //   return redirect('/')
  // }
  // const pipeline = kv.pipeline()

  // for (const chat of chats) {
  //   pipeline.del(chat)
  //   pipeline.zrem(`user:chat:${session.user.id}`, chat)
  // }

  // await pipeline.exec()

  // revalidatePath('/')
  // return redirect('/')
}

export async function getSharedChat(id: string) {


  await connect();
  const response = await Client.hGetAll(`chat:${id}`)
  const chat = response.chat ? JSON.parse(response.chat) : null


  if (!chat || !chat.sharePath) {
    return null
  }

  return chat


  // const chat = await kv.hgetall<Chat>(`chat:${id}`)

  // if (!chat || !chat.sharePath) {
  //   return null
  // }

  // return chat

}

export async function shareChat(id: string) {

  const session = await auth()

  if (!session?.user?.id || session.user.id !== id) {
    return {
      error: 'Unauthorized'
    }
  }

  await connect();
  const response = await Client.hGetAll(`chat:${id}`)
  const chat = response.chat ? JSON.parse(response.chat) : null


  const payload = {
    ...chat,
    sharePath: `/share/${chat.id}`
  }

  await connect();
  await Client.hSet(`chat:${chat.id}`, 'chat', JSON.stringify(payload));


  return payload
  
  // const session = await auth()

  // if (!session?.user?.id) {
  //   return {
  //     error: 'Unauthorized'
  //   }
  // }

  // const chat = await kv.hgetall<Chat>(`chat:${id}`)

  // if (!chat || chat.userId !== session.user.id) {
  //   return {
  //     error: 'Something went wrong'
  //   }
  // }

  // const payload = {
  //   ...chat,
  //   sharePath: `/share/${chat.id}`
  // }

  // await kv.hmset(`chat:${chat.id}`, payload)

  // return payload
}
