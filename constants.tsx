
import React from 'react';
import { Asset, Category, User } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'BuildMaster',
    username: 'BuildMaster_RBX',
    avatar: 'https://picsum.photos/seed/u1/200',
    provider: 'discord',
    followers: ['u2'],
    following: ['u2']
  },
  {
    id: 'u2',
    name: 'ScriptingWizard',
    username: 'WizDev',
    avatar: 'https://picsum.photos/seed/u2/200',
    provider: 'google',
    followers: ['u1'],
    following: []
  }
];

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'a1',
    userId: 'u1',
    authorName: 'BuildMaster',
    authorAvatar: 'https://picsum.photos/seed/u1/200',
    title: 'Modern Low Poly City Pack',
    description: 'A complete modular city kit with over 50 unique buildings and props. Perfect for simulators!',
    category: Category.MAP,
    thumbnailUrl: 'https://picsum.photos/seed/a1/800/450',
    fileType: '.rbxl',
    creditsRequired: true,
    likes: ['u1', 'u2'],
    dislikes: [],
    // Fix: Add missing reports property
    reports: [],
    comments: [
      {
        id: 'c1',
        userId: 'u2',
        userName: 'ScriptingWizard',
        userAvatar: 'https://picsum.photos/seed/u2/200',
        text: 'This is absolutely amazing! Saved me weeks of work.',
        timestamp: Date.now() - 86400000
      }
    ],
    downloadCount: 1542,
    timestamp: Date.now() - 172800000
  },
  {
    id: 'a2',
    userId: 'u2',
    authorName: 'ScriptingWizard',
    authorAvatar: 'https://picsum.photos/seed/u2/200',
    title: 'Advanced Inventory System',
    description: 'A robust inventory system with crafting, drag & drop, and stackable items. Fully modular.',
    category: Category.MODULE,
    thumbnailUrl: 'https://picsum.photos/seed/a2/800/450',
    fileType: '.rbxm',
    creditsRequired: false,
    likes: ['u1'],
    dislikes: [],
    // Fix: Add missing reports property
    reports: [],
    comments: [],
    downloadCount: 890,
    timestamp: Date.now() - 3600000
  },
  {
    id: 'a4',
    userId: 'u2',
    authorName: 'ScriptingWizard',
    authorAvatar: 'https://picsum.photos/seed/u2/200',
    title: 'QuickUI Styler Pro',
    description: 'The ultimate UI styling plugin. Mass edit properties, save themes, and export directly to CSS-like configurations.',
    category: Category.PLUGIN,
    thumbnailUrl: 'https://picsum.photos/seed/a4/800/450',
    fileType: '.rbxmx',
    creditsRequired: false,
    likes: ['u1', 'u2'],
    dislikes: [],
    // Fix: Add missing reports property
    reports: [],
    comments: [],
    downloadCount: 2310,
    timestamp: Date.now() - 1000000
  },
  {
    id: 'a3',
    userId: 'u1',
    authorName: 'BuildMaster',
    authorAvatar: 'https://picsum.photos/seed/u1/200',
    title: 'Hyper-Realistic PBR Rocks',
    description: 'Pack of 12 scanned rocks for realistic environments.',
    category: Category.MODEL_3D,
    thumbnailUrl: 'https://picsum.photos/seed/a3/800/450',
    fileType: '.rbxm',
    creditsRequired: true,
    likes: ['u2'],
    dislikes: [],
    // Fix: Add missing reports property
    reports: [],
    comments: [],
    downloadCount: 450,
    timestamp: Date.now() - 50000000
  }
];

export const Icons = {
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  Model: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  Script: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Like: (props: { filled?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill={props.filled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904M14.25 9h2.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.551.5.96a12.192 12.192 0 0 0-.6 2.22m0 0A12.148 12.148 0 0 0 5.83 18.5" />
    </svg>
  ),
  Dislike: (props: { filled?: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill={props.filled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.594 1.2.432 2.688-.31 3.812-.447.675-1.143 1.04-1.891 1.04h-3.126c-.618 0-1.026.724-.863 1.282.463.975.723 2.066.723 3.218a2.25 2.25 0 0 1-2.25 2.25c-.172 0-.34-.02-.501-.058a.75.75 0 0 1-.607-.942v-1.124c0-.573-.105-1.137-.308-1.669-.204-.533-.514-1.018-.916-1.432a9.041 9.041 0 0 1-2.861-2.4c-.498-.634-1.225-1.08-2.031-1.08H5.904M5.904 5.5c-.083-.205-.173-.405-.27-.602a.607.607 0 0 1 .523-.898h.908c.889 0 1.713.518 1.972 1.368.175.57.34 1.156.495 1.758a12.106 12.106 0 0 1 .521 3.507c0 1.553-.295 3.036-.831 4.398-.273.692-1.053 1.145-1.886 1.145H5c-.472 0-.745-.551-.5-.96a12.192 12.192 0 0 0 .6-2.22m0 0A12.148 12.148 0 0 1 5.83 5.5" />
    </svg>
  ),
  Download: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
};
