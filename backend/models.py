from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from database import Base

class PartyMembers(Base):
    __tablename__ = 'party_member'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    level = Column(Integer, index=True)
    limit_level = Column(Integer, index=True)
    age_epoch = Column(String, index=True)
    hp = Column(Integer, index=True)
    mp = Column(Integer, index=True)
    image_path = Column(String, index=True)
