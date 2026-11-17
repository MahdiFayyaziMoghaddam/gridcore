import bcrypt from 'bcryptjs'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants'
import { userQueries } from '@/lib/db/queries/users'

export const authQueries = {
  async validateCredentials(email: string, password: string) {
    const user = await userQueries.getByEmail(email)

    if (!user?.password) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.password)
    return isValid ? user : null
  },

  hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
  },
}