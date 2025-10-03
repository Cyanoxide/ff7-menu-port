from typing import Union

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Annotated
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
models.Base.metadata.create_all(bind=engine)


class PartyMember(BaseModel):
    name: str
    image_path: str
    level: int
    limit_level: int
    age_epoch: int
    hp: int
    mp: int


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

@app.get("/partymember/{member_id}")
async def get_party_member(member_id: int, db: db_dependency):
    result = db.query(models.PartyMembers).filter(models.PartyMembers.id == member_id).first()
    print(result)
    if not result:
        raise HTTPException(status_code=404, detail="Party Member Not Found")
    return result

@app.post("/partymember/")
async def create_party_member(party_member: PartyMember, db: db_dependency):
    db_party_member = models.PartyMembers(
        name=party_member.name,
        level=party_member.level,
        limit_level=party_member.limit_level,
        age_epoch=party_member.age_epoch,
        hp=party_member.hp,
        mp=party_member.mp,
        image_path=party_member.image_path
    )
    db.add(db_party_member)
    db.commit()
    # db.refresh()


# @app.get("/")
# def read_root():
#     return {"Hello": "World"}


# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: Union[str, None] = None):
#     return {"item_id": item_id, "q": q}


# @app.put("/items/{item_id}")
# def update_item(item_id: int, item: Item):
#     return {"item_name": item.name, "item_id": item_id}