import { GuildMember } from 'discord.js'

export const guardRoleGambler = (member: GuildMember): boolean => {
    const requiredRoleId = process.env.GAMBLER_ROLE_ID!

    if (member.roles.cache.has(requiredRoleId)) {
        return true
    } else {
        console.log(
            `Usuario sin gambler role, ${JSON.stringify({
                member: member.roles,
                requiredRoleId,
            })}`
        )
        throw new Error('❌ Usuario no tiene Gambler role')
    }
}
