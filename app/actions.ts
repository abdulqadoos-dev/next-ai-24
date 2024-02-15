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

}

export async function getSharedChat(id: string) {


  await connect();
  const response = await Client.hGetAll(`chat:${id}`)
  const chat = response.chat ? JSON.parse(response.chat) : null


  if (!chat || !chat.sharePath) {
    return null
  }

  return chat

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

}
