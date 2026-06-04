from pydantic import BaseModel, EmailStr, field_validator
import re

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    street: str
    house: str
    apartment: str | None = None
    floor: str | None = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) <= 6:
            raise ValueError('Пароль должен быть строго больше 6 символов')
        if not re.search(r"[A-Za-zА-Яа-я]", v):
            raise ValueError('Пароль должен содержать хотя бы одну букву')
        if not re.search(r"\d", v):
            raise ValueError('Пароль должен содержать хотя бы одну цифру')
        return v

class BudgetUpdate(BaseModel):
    budget: float

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    street: str | None
    house: str | None
    apartment: str | None
    floor: str | None
    monthly_budget: float
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None