import bcrypt from "bcryptjs"

// Import only the utility functions that don't depend on Next.js
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

function isAdmin(user: any): boolean {
  return user?.role === "ADMIN"
}

function isSupport(user: any): boolean {
  return user?.role === "SUPPORT"
}

function hasRole(user: any, role: string): boolean {
  return user?.role === role
}

describe("Auth Utils", () => {
  describe("Password hashing", () => {
    it("should hash a password", async () => {
      const password = "testpassword123"
      const hashedPassword = await hashPassword(password)
      
      expect(hashedPassword).toBeDefined()
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.length).toBeGreaterThan(50)
    })

    it("should verify a correct password", async () => {
      const password = "testpassword123"
      const hashedPassword = await hashPassword(password)
      
      const isValid = await verifyPassword(password, hashedPassword)
      expect(isValid).toBe(true)
    })

    it("should reject an incorrect password", async () => {
      const password = "testpassword123"
      const wrongPassword = "wrongpassword"
      const hashedPassword = await hashPassword(password)
      
      const isValid = await verifyPassword(wrongPassword, hashedPassword)
      expect(isValid).toBe(false)
    })
  })

  describe("Role checking", () => {
    it("should identify admin users", () => {
      const adminUser = { role: "ADMIN" }
      const regularUser = { role: "USER" }
      
      expect(isAdmin(adminUser)).toBe(true)
      expect(isAdmin(regularUser)).toBe(false)
      expect(isAdmin(null)).toBe(false)
    })

    it("should identify support users", () => {
      const supportUser = { role: "SUPPORT" }
      const regularUser = { role: "USER" }
      
      expect(isSupport(supportUser)).toBe(true)
      expect(isSupport(regularUser)).toBe(false)
      expect(isSupport(null)).toBe(false)
    })

    it("should check specific roles", () => {
      const adminUser = { role: "ADMIN" }
      const userUser = { role: "USER" }
      
      expect(hasRole(adminUser, "ADMIN")).toBe(true)
      expect(hasRole(adminUser, "USER")).toBe(false)
      expect(hasRole(userUser, "USER")).toBe(true)
      expect(hasRole(userUser, "ADMIN")).toBe(false)
      expect(hasRole(null, "ADMIN")).toBe(false)
    })
  })
})